import { Fragment, useState, useEffect } from 'react'; 
import * as Yup from 'yup';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography'; 
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Alert from '@mui/material/Alert';

import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

import FlexRowAlign from '@/components/flexbox/FlexRowAlign';
import FlexBetween from '@/components/flexbox/FlexBetween';
import FlexBox from '@/components/flexbox/FlexBox';
import { StyledDivider } from './styles';
import loginApi from '@/api/login/loginApi';
import { useAuth } from '@/contexts/AuthContext'; 

const validationSchema = Yup.object().shape({
    email: Yup.string().required('Email không được để trống'),
    password: Yup.string().required('Mật khẩu không được để trống'),
});

export default function LoginPage({ login }) {
    const [showPassword, setShowPassword] = useState(false);
    const [errorAlert, setErrorAlert] = useState(false);

    const methods = useForm({
        defaultValues: {
            email: '',
            password: '',
        },
        resolver: yupResolver(validationSchema)
    });

    const { handleSubmit, formState: { isSubmitting } } = methods;

    const { setUser, setToken } = useAuth();
    const onSubmit = async (data) => {
        // console.log('SUBMIT DATA:', data);
        try {
            const respone = await loginApi.login({
                email: data.email.trim(),
                password: data.password.trim(),
            });

            console.log('Đăng nhập thành công:', respone);
            
            setToken(respone.token);
            setUser(respone.user);

            window.location.href = '/admin';
        } catch (error) {
            console.error('Đăng nhập thất bại:', error);
            setErrorAlert(true);
        }
    }

    useEffect(() => {
        if (errorAlert) {
            const timer = setTimeout(() => setErrorAlert(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [errorAlert]);

    return (
        <Grid container height="100%">
            { errorAlert && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 16,
                        right: 16,
                        zIndex: 1300,
                        minWidth: 300
                    }}
                >
                    <Alert
                        severity="error"
                        variant="filled"
                        onClose={() => setErrorAlert(false)}
                    >
                        Đăng nhập thất bại! Vui lòng kiểm tra lại tài khoản và mật khẩu.
                    </Alert>
                </Box>
            )}
            <Grid size={{ md: 6, xs: 12}}>
            <FlexRowAlign bgcolor="primary.main" height="100%">
            <Box color="white" p={6} maxWidth={700}>
                {
                login ? <Typography variant="h4"> Xin chào </Typography> : <Fragment>
                    <FlexBox gap={2} alignItems="center">
                        <Box component="img" src="/logo-vnua.png" alt="vnua" sx={{ height: 60, objectFit: 'contain', borderRadius:'1.5rem' }} />
                        <Box component="img" src="/fita.png" alt="fita-vnua" sx={{ height: 60, objectFit: 'contain', borderRadius:'1.8rem' }} />
                        <Box component="img" src="/st.png" alt="st-team-vnua" sx={{ height: 60, objectFit: 'contain', borderRadius:'1.8rem' }} />
                    </FlexBox>
                    
                    <Typography variant="h4" sx={{ mt: 3, maxWidth: 450 }}>
                        Hệ thống hỗ trợ sinh viên có ứng dụng trí tuệ nhân tạo
                    </Typography>

                    <Divider sx={{ borderColor: 'white', my: 3 }} />
                </Fragment>
                }

                <Box my={4}>
                    <Typography variant="body1" fontWeight={500} fontSize={20}>
                        Một dự án nhỏ, vì sinh viên – bởi sinh viên
                    </Typography>

                    <Typography variant="body2" mt={1}>
                        Đây là một bước khởi đầu, với mong muốn mở ra một hướng đi mới cho các hệ thống nội bộ thân thiện và thông minh hơn.
                    </Typography>
                </Box>
            </Box>
            </FlexRowAlign>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
            <FlexRowAlign bgcolor="background.paper" height="100%">
                <Box maxWidth={550} p={4}>
                    <Typography variant="h4" fontWeight={600} fontSize={{ sm: 30, xs: 25 }}>
                        Đăng nhập
                    </Typography>

                    <FormProvider {...methods}>
                    <Grid container spacing={2} component="form" onSubmit={ handleSubmit(onSubmit) }>
                        <Grid size={12}>
                        <Typography variant="body1" fontSize={16} mb={2} mt={5}>
                            Đăng nhập bằng tài khoản quản trị được cấp
                        </Typography>

                        <Controller
                            name="email"
                            control={methods.control}
                            render={({ field, fieldState: { error } }) => (
                                <TextField 
                                    {...field} 
                                    fullWidth 
                                    type='email'
                                    placeholder="Email được cấp" 
                                    error={!!error} 
                                    helperText={error?.message} 
                                />
                            )}
                        />
                        </Grid>

                        <Grid size={12}>
                        <Controller
                            name="password"
                            control={methods.control}
                            render={({ field, fieldState: { error } }) => (
                                <TextField 
                                    {...field} 
                                    fullWidth 
                                    placeholder="Mật khẩu" 
                                    type={showPassword ? 'text' : 'password'} 
                                    error={!!error} 
                                    helperText={error?.message} 
                                    slotProps={{
                                        input: {
                                            endAdornment: 
                                            <ButtonBase 
                                                disableRipple disableTouchRipple 
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </ButtonBase>
                                        }
                                    }} 
                                />
                            )}
                        />
                        </Grid>

                        <Grid size={12}>
                        <Button fullWidth type="submit" variant="contained" disabled={ isSubmitting }>
                            Đăng nhập
                        </Button>
                        </Grid>
                    </Grid>
                    </FormProvider>

                    <StyledDivider></StyledDivider>
                </Box>
            </FlexRowAlign>
        </Grid>
    </Grid>
    )
}